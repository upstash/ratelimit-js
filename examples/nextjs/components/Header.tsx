import { Breadcrumb, BreadcrumbProps } from "./Breadcrumb";
import StarButton from "./StarButton";
import React from "react";

export type HeaderProps = {
  breadcrumbOptions: BreadcrumbProps;
};

export default function Header({ breadcrumbOptions }: HeaderProps) {
  return (
    <header className="relative z-10 flex items-center bg-gray-900 py-4 px-6 text-gray-50">
      <Breadcrumb {...breadcrumbOptions} />
      <div className="ml-auto hidden sm:block">
        <StarButton {...[...breadcrumbOptions?.data].pop()} />
      </div>
    </header>
  );
}
